import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// GET — list conversations or messages for a conversation
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const conversationId = req.nextUrl.searchParams.get('conversationId');

  // If conversationId provided, return messages for that conversation
  if (conversationId) {
    const { data: messages } = await supabase
      .from('messages')
      .select('id, sender_id, content, is_read, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(100);

    // Mark unread messages as read
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('is_read', false);

    return NextResponse.json({ messages: messages ?? [] });
  }

  // Otherwise, list all conversations
  const { data: convosA } = await supabase
    .from('conversations')
    .select('id, participant_a, participant_b, last_message_at')
    .eq('participant_a', user.id)
    .order('last_message_at', { ascending: false });

  const { data: convosB } = await supabase
    .from('conversations')
    .select('id, participant_a, participant_b, last_message_at')
    .eq('participant_b', user.id)
    .order('last_message_at', { ascending: false });

  const allConvos = [...(convosA ?? []), ...(convosB ?? [])]
    .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

  // Get other participant profiles and unread counts
  const otherIds = allConvos.map(c =>
    c.participant_a === user.id ? c.participant_b : c.participant_a
  );

  const { data: profiles } = otherIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', otherIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

  // Get last message and unread count for each conversation
  const conversations = await Promise.all(
    allConvos.map(async (c) => {
      const otherId = c.participant_a === user.id ? c.participant_b : c.participant_a;
      const profile = profileMap.get(otherId);

      const { data: lastMsg } = await supabase
        .from('messages')
        .select('content, sender_id, created_at')
        .eq('conversation_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const { count: unreadCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', c.id)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      return {
        id: c.id,
        otherUser: {
          id: otherId,
          name: profile?.full_name ?? 'Användare',
          avatar: profile?.avatar_url ?? null,
        },
        lastMessage: lastMsg?.content ?? null,
        lastMessageAt: lastMsg?.created_at ?? c.last_message_at,
        lastMessageIsOwn: lastMsg?.sender_id === user.id,
        unreadCount: unreadCount ?? 0,
      };
    })
  );

  // Total unread across all conversations
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return NextResponse.json({ conversations, totalUnread });
}

// POST — send a message (creates conversation if needed)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { recipientId, content, conversationId } = await req.json();

  if (!content || content.trim().length === 0) {
    return NextResponse.json({ error: 'Meddelande krävs' }, { status: 400 });
  }

  if (content.length > 2000) {
    return NextResponse.json({ error: 'Meddelandet är för långt (max 2000 tecken)' }, { status: 400 });
  }

  let convoId = conversationId;

  // If conversationId is provided, verify the user is a participant
  if (conversationId) {
    const { data: convo } = await supabase
      .from('conversations')
      .select('participant_a, participant_b')
      .eq('id', conversationId)
      .single();

    if (!convo || (convo.participant_a !== user.id && convo.participant_b !== user.id)) {
      return NextResponse.json({ error: 'Ingen åtkomst till denna konversation' }, { status: 403 });
    }
  }

  // If no conversationId, find or create conversation
  if (!convoId) {
    if (!recipientId) {
      return NextResponse.json({ error: 'recipientId eller conversationId krävs' }, { status: 400 });
    }

    if (recipientId === user.id) {
      return NextResponse.json({ error: 'Kan inte skicka meddelande till dig själv' }, { status: 400 });
    }

    // Canonical ordering: smaller UUID first
    const [a, b] = user.id < recipientId
      ? [user.id, recipientId]
      : [recipientId, user.id];

    // Try to find existing conversation
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('participant_a', a)
      .eq('participant_b', b)
      .single();

    if (existing) {
      convoId = existing.id;
    } else {
      const { data: newConvo, error } = await supabase
        .from('conversations')
        .insert({ participant_a: a, participant_b: b })
        .select('id')
        .single();

      if (error) {
        // Handle race condition: another request may have created the conversation
        const { data: retryConvo } = await supabase
          .from('conversations')
          .select('id')
          .eq('participant_a', a)
          .eq('participant_b', b)
          .single();
        if (retryConvo) {
          convoId = retryConvo.id;
        } else {
          return NextResponse.json({ error: 'Kunde inte skapa konversation' }, { status: 500 });
        }
      } else {
        convoId = newConvo.id;
      }
    }
  }

  // Insert message
  const { data: message, error: msgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: convoId,
      sender_id: user.id,
      content: content.trim(),
    })
    .select('id, sender_id, content, created_at')
    .single();

  if (msgError) {
    return NextResponse.json({ error: 'Kunde inte skicka meddelande' }, { status: 500 });
  }

  // Update conversation last_message_at
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', convoId);

  // Send email notification to recipient (non-blocking)
  sendMessageEmailNotification(supabase, user.id, convoId, content.trim()).catch(
    (err) => console.error('Message email notification failed:', err)
  );

  return NextResponse.json({ message, conversationId: convoId });
}

// ── Email notification helper ──────────────────────────────────

async function sendMessageEmailNotification(
  supabase: SupabaseClient,
  senderId: string,
  conversationId: string,
  messageContent: string
) {
  // Find the other participant
  const { data: convo } = await supabase
    .from('conversations')
    .select('participant_a, participant_b')
    .eq('id', conversationId)
    .single();

  if (!convo) return;

  const recipientId = convo.participant_a === senderId ? convo.participant_b : convo.participant_a;

  // No dedicated message notification preference exists yet; always send (opt-out model).

  // Get profiles
  const [senderResult, recipientResult] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', senderId).single(),
    supabase.from('profiles').select('full_name, email').eq('id', recipientId).single(),
  ]);

  const recipientEmail = recipientResult.data?.email;
  if (!recipientEmail) return;

  const senderName = senderResult.data?.full_name || 'En användare';
  const recipientName = recipientResult.data?.full_name || 'Användare';
  const preview = messageContent.length > 100 ? messageContent.slice(0, 100) + '…' : messageContent;

  try {
    const { sendNewMessageEmail } = await import('@/lib/email/send-message');
    await sendNewMessageEmail({
      to: recipientEmail,
      recipientName,
      senderName,
      messagePreview: preview,
    });
  } catch (err) {
    console.error('Failed to send message email:', err);
  }
}

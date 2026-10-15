// POST /api/ownerFakeVotes { link, liked, count } — or { channelId, musicId, liked, count }.
// Adds made-up voters to a channel post and redraws its buttons. Owner only.
// → { channel_title, musicId, added, liked, disliked }
import { EndpointError } from 'sdk';
import { requireOwner } from '../lib/access.js';
import { resolvePost, addFakeVotes, FakeVoteError } from '../lib/fakeVotes.js';

export default async function ({ link, channelId, musicId, liked = true, count } = {}, ctx) {
  requireOwner(ctx);
  try {
    const post = await resolvePost({ link: typeof link === 'string' ? link.slice(0, 200) : null, musicId, channelId });
    const r = await addFakeVotes({ ...post, liked: Boolean(liked), count });
    return { channel_title: r.channel.title, musicId: r.musicId, added: r.added, liked: r.liked, disliked: r.disliked };
  } catch (e) {
    if (e instanceof FakeVoteError) throw new EndpointError(e.message, { code: 'BAD_INPUT' });
    throw e;
  }
}

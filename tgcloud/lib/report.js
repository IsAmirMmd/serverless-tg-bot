// Report rows built from the likes table: one row per user and one per track.

// The table-bound query builder returns booleans; accept 0/1 too.
export const isLiked = (v) => v === true || v === 1;

// One row per user: the music ids they liked and disliked.
export function buildUserReport(likes) {
  const userMap = {};
  for (const row of likes) {
    if (!userMap[row.user_id]) {
      userMap[row.user_id] = { user_id: row.user_id, user_name: row.user_name, liked: [], disliked: [] };
    }
    const user = userMap[row.user_id];
    (isLiked(row.liked) ? user.liked : user.disliked).push(row.music_id);
  }
  return Object.values(userMap).map((user) => ({
    user_id: user.user_id,
    user_name: user.user_name,
    liked_musics: user.liked.join(', '),
    disliked_musics: user.disliked.join(', '),
    total_liked: user.liked.length,
    total_disliked: user.disliked.length,
  }));
}

// One row per music: who liked it.
export function buildMusicReport(likes) {
  const musicMap = {};
  for (const row of likes) {
    if (!isLiked(row.liked)) continue;
    const musicName = row.music_name && String(row.music_name).trim()
      ? row.music_name
      : `Music #${row.music_id}`;
    if (!musicMap[musicName]) musicMap[musicName] = { music_name: musicName, users: [] };
    musicMap[musicName].users.push(row.user_name || String(row.user_id));
  }
  return Object.values(musicMap).map((m) => ({
    music_name: m.music_name,
    liked_by: m.users.join(', '),
    total_likes: m.users.length,
  }));
}

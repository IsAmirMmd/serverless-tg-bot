// The three tables: which endpoint feeds each one and how its columns render.
import { fa, faDate, faDigits } from './lib/format.js';
import { UserCell, MusicCell, VoteBadge, ListCell, MusicIdsCell } from './components/cells.jsx';

// Rows carry channel_title and post_base (link prefix for that channel's posts).
export const CHANNEL_COLUMN = {
  key: 'channel', title: 'کانال', className: 'mz-cell-nowrap', render: (r) => r.channel_title ?? '—',
};

export const VIEWS = {
  likes: {
    label: 'رأی‌ها',
    endpoint: 'adminLikes',
    search: 'جستجوی کاربر، آهنگ یا شناسه…',
    filters: true,
    rowKey: (r) => r.id,
    columns: [
      { key: 'id', title: '#', className: 'mz-cell-num', render: (r) => faDigits(r.id) },
      { key: 'user', title: 'کاربر', className: 'mz-cell-nowrap', render: (r) => <UserCell name={r.user_name} id={r.user_id} /> },
      { key: 'music', title: 'آهنگ', className: 'mz-cell-wrap', render: (r) => <MusicCell name={r.music_name} id={r.music_id} url={r.music_url} /> },
      { key: 'vote', title: 'رأی', render: (r) => <VoteBadge liked={r.liked} /> },
      { key: 'at', title: 'زمان', className: 'mz-cell-num', render: (r) => faDate(r.updated_at ?? r.created_at) },
    ],
  },
  users: {
    label: 'گزارش کاربران',
    endpoint: 'adminUserReport',
    search: 'جستجوی نام کاربری یا شناسه…',
    rowKey: (r) => `${r.channel_id}:${r.user_id}`,
    columns: [
      { key: 'user', title: 'کاربر', className: 'mz-cell-nowrap', render: (r) => <UserCell name={r.user_name} id={r.user_id} /> },
      { key: 'liked', title: '❤️', className: 'mz-cell-num', render: (r) => fa(r.total_liked) },
      { key: 'disliked', title: '🥀', className: 'mz-cell-num', render: (r) => fa(r.total_disliked) },
      { key: 'total', title: 'مجموع', className: 'mz-cell-num', render: (r) => <strong>{fa(r.total_votes)}</strong> },
      { key: 'likedList', title: 'آهنگ‌های لایک‌شده', className: 'mz-cell-wrap', render: (r) => <MusicIdsCell value={r.liked_musics} channelBase={r.post_base} /> },
      { key: 'dislikedList', title: 'آهنگ‌های دیس‌لایک‌شده', className: 'mz-cell-wrap', render: (r) => <MusicIdsCell value={r.disliked_musics} channelBase={r.post_base} /> },
      { key: 'at', title: 'آخرین رأی', className: 'mz-cell-num', render: (r) => faDate(r.last_vote_at) },
    ],
  },
  musics: {
    label: 'گزارش آهنگ‌ها',
    endpoint: 'adminMusicReport',
    search: 'جستجوی نام آهنگ یا شناسه…',
    rowKey: (r) => `${r.channel_id}:${r.music_id}`,
    columns: [
      { key: 'music', title: 'آهنگ', className: 'mz-cell-wrap', render: (r) => <MusicCell name={r.music_name} id={r.music_id} url={r.music_url} /> },
      { key: 'likes', title: '❤️', className: 'mz-cell-num', render: (r) => <strong>{fa(r.total_likes)}</strong> },
      { key: 'dislikes', title: '🥀', className: 'mz-cell-num', render: (r) => fa(r.total_dislikes) },
      { key: 'likedBy', title: 'لایک‌کننده‌ها', className: 'mz-cell-wrap', render: (r) => <ListCell value={r.liked_by} /> },
      { key: 'dislikedBy', title: 'دیس‌لایک‌کننده‌ها', className: 'mz-cell-wrap', render: (r) => <ListCell value={r.disliked_by} /> },
      { key: 'at', title: 'آخرین رأی', className: 'mz-cell-num', render: (r) => faDate(r.last_vote_at) },
    ],
  },
};

export const FILTERS = [
  { id: 'all', label: 'همه' },
  { id: 'liked', label: '❤️ لایک' },
  { id: 'disliked', label: '🥀 دیس‌لایک' },
];

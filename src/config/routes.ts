export const ROUTES = {
  dashboard: "/dashboard",
  media: "/media",
  posts: "/posts",
  postsNew: "/posts/new",
  postDetail: (id: string) => `/posts/${id}`,
  calendar: "/calendar",
  settings: "/settings",
} as const;

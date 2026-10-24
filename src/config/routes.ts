export const ROUTES = {
  dashboard: "/dashboard",
  media: "/media",
  posts: "/posts",
  postsNew: "/posts/new",
  postDetail: (id: string) => `/posts/${id}`,
  calendar: "/calendar",
  brand: "/brand",
  brandTab: (tab: string) => `/brand?tab=${tab}`,
  settings: "/settings",
} as const;

export const routes = {
  home: { pathname: "/" } as const,
  topics: { pathname: "/topics" } as const,
  topic: (slug: string) => ({ pathname: "/topics/[slug]", params: { slug } }) as const,
  communities: { pathname: "/communities" } as const,
  community: (slug: string) => ({ pathname: "/communities/[slug]", params: { slug } }) as const,
};

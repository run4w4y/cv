export default {
  description: 'Representative synthetic skill groups.',
  items: [
    {
      group: 'Frontend',
      subgroups: [
        {
          group: 'React',
          items: [
            'Suspense',
            'TanStack Query',
            'React Hook Form',
            'Server Components',
          ],
        },
        {
          group: 'Astro',
          items: ['islands', 'content collections'],
        },
      ],
      items: ['TypeScript', 'Astro'],
    },
    {
      group: 'Platform',
      items: ['Node.js', 'Cloudflare', 'Playwright'],
    },
  ],
  label: 'Skills',
  printStack: ['React', 'TypeScript', 'Astro', 'Playwright'],
}

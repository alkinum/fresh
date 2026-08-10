import { deriveNoteTitle, extractTags, renderNoteBody } from '$lib/server/markdown';
import type { NoteDto } from '$lib/types';
import type { PageServerLoad } from './$types';

const initialContent = `# Slow Sunday

A little room for **the things that make the week feel lighter**.

- [x] Pick up fresh flowers
- [ ] Finish the window-seat chapter
- [ ] Make lemon pasta

#weekend #soft-plans`;

function tagColor(name: string): string {
  let hash = 0;
  for (const character of name) hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  return `hsl(${hash % 360} 58% 64%)`;
}

export const load: PageServerLoad = () => {
  const now = new Date().toISOString();
  const landingDemoNote: NoteDto = {
    id: 'landing-demo-note',
    title: deriveNoteTitle(initialContent),
    content: initialContent,
    renderedContent: renderNoteBody(initialContent),
    date: now.slice(0, 10),
    colorIndicator: '#36b37e',
    isFavorite: true,
    createdAt: now,
    updatedAt: now,
    tags: extractTags(initialContent).map((name) => ({
      id: `landing-tag-${name}`,
      name,
      color: tagColor(name),
      count: 1,
      createdAt: now,
      updatedAt: now
    })),
    attachments: []
  };

  return { landingDemoNote };
};

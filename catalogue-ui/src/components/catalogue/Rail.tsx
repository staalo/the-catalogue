import { useEffect, useRef, useState } from 'react';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PosterCard } from '@/components/catalogue/PosterCard';
import type { Media } from '@/types';

type RailProps = {
  title: string;
  items: Media[];
  onOpen: (item: Media) => void;
};

export function Rail({ title, items, onOpen }: RailProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) {
      return;
    }

    const update = () => {
      const maxScroll = node.scrollWidth - node.clientWidth;
      setCanScrollLeft(node.scrollLeft > 1);
      setCanScrollRight(maxScroll - node.scrollLeft > 1);
    };

    update();
    node.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(node);

    return () => {
      node.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [items]);

  if (items.length === 0) {
    return null;
  }

  const scroll = (direction: -1 | 1) => {
    const node = scrollerRef.current;
    if (!node) {
      return;
    }

    node.scrollBy({
      left: direction * Math.max(node.clientWidth * 0.75, 240),
      behavior: 'smooth',
    });
  };

  return (
    <Box sx={{ mb: 5 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-.02em' }}>
          {title}
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <IconButton
            size="small"
            aria-label="scroll left"
            disabled={!canScrollLeft}
            onClick={() => scroll(-1)}
          >
            <ChevronLeft />
          </IconButton>
          <IconButton
            size="small"
            aria-label="scroll right"
            disabled={!canScrollRight}
            onClick={() => scroll(1)}
          >
            <ChevronRight />
          </IconButton>
        </Stack>
      </Stack>
      <Box
        ref={scrollerRef}
        sx={{
          display: 'flex',
          gap: { xs: 1.5, md: 2.25 },
          overflowX: 'auto',
          pb: 1,
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {items.map((item) => (
          <PosterCard key={item.id} item={item} onOpen={onOpen} />
        ))}
      </Box>
    </Box>
  );
}

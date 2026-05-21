type QuickActionsProps = {
  items: string[];
  onSelect: (item: string) => void;
};

export function QuickActions({ items, onSelect }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onSelect(item)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
        >
          {item}
        </button>
      ))}
    </div>
  );
}

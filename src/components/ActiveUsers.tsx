import type { User } from "@/types/whiteboard";

export function ActiveUsers({ users }: { users: User[] }) {
  return (
    <div className="hidden items-center gap-1 md:flex">
      {users.slice(0, 7).map((user) => (
        <div
          key={user.id}
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white shadow-sm"
          style={{ backgroundColor: user.color }}
          title={user.name}
        >
          {initials(user.name)}
        </div>
      ))}
      {users.length > 7 ? (
        <div className="flex h-9 min-w-9 items-center justify-center rounded-full bg-slate-200 px-2 text-xs font-semibold text-slate-700">
          +{users.length - 7}
        </div>
      ) : null}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

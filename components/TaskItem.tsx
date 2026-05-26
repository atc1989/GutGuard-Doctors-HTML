import Image from "next/image";
import { CheckIcon, ChevronRightIcon } from "@/components/Icons";
import type { TaskId } from "@/lib/types";

type TaskItemProps = {
  id: TaskId;
  number: string;
  title: string;
  meta: string;
  done: boolean;
  hasTikTokMark?: boolean;
  onClick: (id: TaskId) => void;
};

export default function TaskItem({
  id,
  number,
  title,
  meta,
  done,
  hasTikTokMark,
  onClick,
}: TaskItemProps) {
  return (
    <li>
      <button
        type="button"
        className={`task ${done ? "done" : ""}`.trim()}
        onClick={() => onClick(id)}
      >
        <span className="task-num">{number}</span>
        <span className="task-body">
          <span className="task-title">
            {hasTikTokMark && (
              <span className="task-tiktok-mark">
                <Image src="/tiktok-logo.png" alt="" width={26} height={32} />
              </span>
            )}
            {title}
          </span>
          <span className="task-meta">{meta}</span>
        </span>
        <span className="task-end">
          <ChevronRightIcon />
          <CheckIcon />
        </span>
      </button>
    </li>
  );
}

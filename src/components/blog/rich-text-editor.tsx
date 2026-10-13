"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ToolbarKey =
  | "paragraph"
  | "heading2"
  | "heading3"
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "bulletList"
  | "orderedList"
  | "blockquote"
  | "link"
  | "unlink"
  | "rule"
  | "undo"
  | "redo";

function ToolButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg text-ink hover:bg-azure-50 disabled:opacity-40",
        active && "bg-electric text-white hover:bg-electric-hover",
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  );
}

function Toolbar({ editor, linkPrompt }: { editor: Editor; linkPrompt: string }) {
  const t = useTranslations("Admin.blog.editor.toolbar");
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      paragraph: e.isActive("paragraph"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  const label = (k: ToolbarKey) => t(k);

  function setLink() {
    const previous = (editor.getAttributes("link").href as string | undefined) ?? "https://";
    const url = window.prompt(linkPrompt, previous)?.trim();
    if (url === undefined) return;
    if (url === "" || url === "https://") return void chain().extendMarkRange("link").unsetLink().run();
    // Only web and mail links are accepted (the server sanitizer enforces it too).
    if (!/^(https?:\/\/|mailto:)/i.test(url)) return;
    chain().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div role="toolbar" aria-label={t("label")} className="flex flex-wrap items-center gap-1 border-b border-azure-50 bg-mist p-2">
      <ToolButton icon={Pilcrow} label={label("paragraph")} active={s.paragraph} onClick={() => chain().setParagraph().run()} />
      <ToolButton icon={Heading2} label={label("heading2")} active={s.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()} />
      <ToolButton icon={Heading3} label={label("heading3")} active={s.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()} />
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
      <ToolButton icon={Bold} label={label("bold")} active={s.bold} onClick={() => chain().toggleBold().run()} />
      <ToolButton icon={Italic} label={label("italic")} active={s.italic} onClick={() => chain().toggleItalic().run()} />
      <ToolButton icon={Underline} label={label("underline")} active={s.underline} onClick={() => chain().toggleUnderline().run()} />
      <ToolButton icon={Strikethrough} label={label("strike")} active={s.strike} onClick={() => chain().toggleStrike().run()} />
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
      <ToolButton icon={List} label={label("bulletList")} active={s.bullet} onClick={() => chain().toggleBulletList().run()} />
      <ToolButton icon={ListOrdered} label={label("orderedList")} active={s.ordered} onClick={() => chain().toggleOrderedList().run()} />
      <ToolButton icon={Quote} label={label("blockquote")} active={s.quote} onClick={() => chain().toggleBlockquote().run()} />
      <ToolButton icon={Minus} label={label("rule")} onClick={() => chain().setHorizontalRule().run()} />
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
      <ToolButton icon={Link2} label={label("link")} active={s.link} onClick={setLink} />
      <ToolButton icon={Link2Off} label={label("unlink")} disabled={!s.link} onClick={() => chain().unsetLink().run()} />
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
      <ToolButton icon={Undo2} label={label("undo")} disabled={!s.canUndo} onClick={() => chain().undo().run()} />
      <ToolButton icon={Redo2} label={label("redo")} disabled={!s.canRedo} onClick={() => chain().redo().run()} />
    </div>
  );
}

/**
 * Rich text editor (Tiptap). The HTML travels in a hidden input named `name`;
 * the server sanitizes it with an allowlist before saving.
 */
export function RichTextEditor({
  name,
  labelId,
  defaultValue,
  lang,
  invalid,
  describedBy,
  onChange,
}: {
  name: string;
  labelId: string;
  defaultValue: string;
  lang: string;
  invalid?: boolean;
  describedBy?: string;
  onChange?: (html: string) => void;
}) {
  const t = useTranslations("Admin.blog.editor.toolbar");
  const [html, setHtml] = useState(defaultValue);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"], defaultProtocol: "https" },
      }),
    ],
    content: defaultValue,
    editorProps: {
      attributes: {
        class: "prose-element px-4 py-3",
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelId,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(invalid ? { "aria-invalid": "true" } : {}),
        lang,
      },
    },
    onUpdate: ({ editor: e }) => {
      const next = e.isEmpty ? "" : e.getHTML();
      setHtml(next);
      onChange?.(next);
    },
  });

  return (
    <div className={cn("overflow-hidden rounded-[20px] border border-azure-100 bg-white focus-within:border-electric focus-within:ring-[3px] focus-within:ring-electric/15", invalid && "border-destructive")}>
      {editor ? <Toolbar editor={editor} linkPrompt={t("linkPrompt")} /> : <div className="h-10 border-b bg-surface" />}
      <EditorContent editor={editor} />
      <input type="hidden" name={name} value={html} />
    </div>
  );
}

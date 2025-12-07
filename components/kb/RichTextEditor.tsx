import React, { useState } from 'react';
import axios from 'axios';
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Heading from '@tiptap/extension-heading';
import Mention from '@tiptap/extension-mention';
import suggestion from './suggestion'; 
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Heading1, Heading2, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import MediaLibraryModal from './MediaLibraryModal';
import ResizableImageNode from './ResizableImageNode';
import { toast } from 'react-hot-toast';

interface RichTextEditorProps {
    content: string;
    onChange: (html: string) => void;
    editable?: boolean;
}

// CSS to force visual consistency inside the editor
const editorStyles = `
  .ProseMirror p { margin-bottom: 0.75em; line-height: 1.6; overflow-wrap: break-word; }
  .ProseMirror p:empty::before { content: " "; display: inline-block; }
  .ProseMirror h1 { font-size: 1.75em; font-weight: 800; margin-top: 1.5em; margin-bottom: 0.5em; color: var(--color-text-primary); }
  .ProseMirror h2 { font-size: 1.4em; font-weight: 700; margin-top: 1.25em; margin-bottom: 0.5em; color: var(--color-text-primary); }
  .ProseMirror h3 { font-size: 1.2em; font-weight: 600; margin-top: 1em; margin-bottom: 0.5em; color: var(--color-text-primary); }
  .ProseMirror ul { list-style-type: disc; padding-left: 1.5em; margin-bottom: 1em; }
  .ProseMirror ol { list-style-type: decimal; padding-left: 1.5em; margin-bottom: 1em; }
  .ProseMirror a { color: var(--color-primary); text-decoration: underline; cursor: pointer; }
  .ProseMirror img { max-width: 100%; height: auto; border-radius: 0.5rem; margin: 1em 0; display: inline-block; }
  
  /* Style for the Wiki Link Bubble inside the Editor */
  .ProseMirror .kb-mention {
      color: var(--color-primary);
      background-color: color-mix(in srgb, var(--color-primary), white 85%); 
      padding: 0.1rem 0.3rem;
      border-radius: 0.3rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s;
      /* FIX: Allow chips to wrap on mobile */
      white-space: normal;
      display: inline-block;
      margin-bottom: 2px;
  }
  .ProseMirror .kb-mention:hover {
      background-color: var(--color-primary);
      color: var(--color-on-primary);
  }
  .ProseMirror:focus { outline: none; }

  /* Text Alignment Styles */
  .ProseMirror p.is-right { text-align: right; }
  .ProseMirror p.is-center { text-align: center; }
  .ProseMirror p.is-left { text-align: left; }
`;

const MenuBar = ({ editor, onOpenMedia }: { editor: any, onOpenMedia: () => void }) => {
    if (!editor) return null;

    const btnClass = (isActive: boolean) => 
        `p-2 rounded hover:bg-surface transition-colors ${isActive ? 'text-primary bg-primary/10' : 'text-text-secondary'}`;

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('URL', previousUrl);
        if (url === null) return;
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };

    // SMART ALIGNMENT: Handles both Text and Images
    const setAlignment = (align: 'left' | 'center' | 'right') => {
        if (editor.isActive('image')) {
            editor.chain().focus().updateAttributes('image', { align }).run();
        } else {
            editor.chain().focus().setTextAlign(align).run();
        }
    };
    
    const activeAlign = (align: string) => {
        if (editor.isActive('image')) return editor.getAttributes('image').align === align;
        return editor.isActive({ textAlign: align });
    };

    return (
        // Toolbar: Wraps on mobile, single line on desktop
        <div className="flex flex-wrap items-center gap-1 border-b border-border p-2 bg-background z-10">
            <button onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive('bold')) + " shrink-0"} title="Bold">
                <Bold size={18} />
            </button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive('italic')) + " shrink-0"} title="Italic">
                <Italic size={18} />
            </button>
            <button onClick={setLink} className={btnClass(editor.isActive('link')) + " shrink-0"} title="Add Link">
                <LinkIcon size={18} />
            </button>
            <button onClick={onOpenMedia} className={btnClass(false) + " shrink-0"} title="Insert Image">
                <ImageIcon size={18} />
            </button>
            <div className="w-px h-6 bg-border mx-2 shrink-0"></div>
            
            {/* Header Buttons */}
            <button 
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} 
                className={btnClass(editor.isActive('heading', { level: 1 })) + " shrink-0"} 
                title="Heading 1"
            >
                <Heading1 size={18} />
            </button>
            <button 
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} 
                className={btnClass(editor.isActive('heading', { level: 2 })) + " shrink-0"} 
                title="Heading 2"
            >
                <Heading2 size={18} />
            </button>
            
            <div className="w-px h-6 bg-border mx-2 shrink-0"></div>
            {/* ALIGNMENT CONTROLS */}
            <button onClick={() => setAlignment('left')} className={btnClass(activeAlign('left')) + " shrink-0"} title="Align Left"><AlignLeft size={18} /></button>
            <button onClick={() => setAlignment('center')} className={btnClass(activeAlign('center')) + " shrink-0"} title="Align Center"><AlignCenter size={18} /></button>
            <button onClick={() => setAlignment('right')} className={btnClass(activeAlign('right')) + " shrink-0"} title="Align Right"><AlignRight size={18} /></button>

            <div className="w-px h-6 bg-border mx-2 shrink-0"></div>
            <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive('bulletList')) + " shrink-0"} title="Bullet List">
                <List size={18} />
            </button>
            <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive('orderedList')) + " shrink-0"} title="Ordered List">
                <ListOrdered size={18} />
            </button>
        </div>
    );
};

const RichTextEditor: React.FC<RichTextEditorProps> = ({ content, onChange, editable = true }) => {
    const [isMediaOpen, setIsMediaOpen] = useState(false);
    
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: false, 
                codeBlock: false, 
            }),
            Heading.configure({ levels: [1, 2, 3] }).extend({
                addAttributes() {
                    return {
                        id: {
                            default: null,
                            parseHTML: element => element.getAttribute('id'),
                            renderHTML: attributes => {
                                if (!attributes.id) return {};
                                return { id: attributes.id };
                            }
                        }
                    }
                }
            }),
            Link.configure({ openOnClick: false }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            
            // CUSTOM IMAGE WITH RESIZING
            Image.extend({
                addAttributes() {
                    return {
                        ...this.parent?.(),
                        width: {
                            default: null,
                            // Ensure width is saved/loaded from HTML
                            parseHTML: element => element.getAttribute('width'),
                            renderHTML: attributes => ({ width: attributes.width })
                        },
                        align: {
                            default: 'center',
                            parseHTML: element => element.getAttribute('align'),
                            renderHTML: attributes => ({ align: attributes.align })
                        },
                        caption: {
                            default: '',
                            parseHTML: element => element.getAttribute('data-caption'),
                            renderHTML: attributes => ({ 'data-caption': attributes.caption })
                        }
                    };
                },
                addNodeView() {
                    return ReactNodeViewRenderer(ResizableImageNode);
                },
            }).configure({ inline: true }),
            
            // SMART LINKING (WIKI LINKS)
            Mention.configure({
                HTMLAttributes: {
                    class: 'kb-mention',
                },
                suggestion: {
                    ...suggestion,
                    char: '[[', 
                    allowSpaces: true,
                },
                // FIX: Store the Title (label) and Anchor
                addAttributes() {
                    return {
                        id: { default: null },
                        anchor: { default: null, parseHTML: element => element.getAttribute('data-anchor'), renderHTML: attributes => ({ 'data-anchor': attributes.anchor }) },
                        label: { default: null, parseHTML: element => element.getAttribute('data-label'), renderHTML: attributes => ({ 'data-label': attributes.label }) },
                    }
                },
                renderText({ node }) {
                    return `${node.attrs.label ?? node.attrs.id}`; 
                },
            }),
        ],
        content: content,
        editable: editable,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'h-full outline-none text-text-primary',
            },
            // HANDLE PASTE & DROP EVENTS
            handlePaste: (view, event, slice) => {
                const item = event.clipboardData?.items[0];
                if (item?.kind === 'file') {
                    event.preventDefault();
                    const file = item.getAsFile();
                    if (file) uploadAndInsert(file, view);
                    return true;
                }
                return false;
            },
            handleDrop: (view, event, slice, moved) => {
                if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
                    const file = event.dataTransfer.files[0];
                    event.preventDefault();
                    uploadAndInsert(file, view);
                    return true;
                }
                return false;
            }
        },
    });
    
    // Helper to upload file and insert node OR link
    const uploadAndInsert = async (file: File, view: any) => {
        const isImage = file.type.startsWith('image/');
        const loadingToast = toast.loading(isImage ? "Uploading image..." : "Uploading file...");
        
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await axios.post('/api/kb/images', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            const { url } = res.data;
            const { schema } = view.state;
            
            if (isImage) {
                const node = schema.nodes.image.create({ src: url });
                const transaction = view.state.tr.replaceSelectionWith(node);
                view.dispatch(transaction);
            } else {
                // Insert a fancy file card (Link)
                const linkMark = schema.marks.link.create({ href: url });
                const textNode = schema.text(`📄 ${file.name}`, [linkMark]);
                const transaction = view.state.tr.replaceSelectionWith(textNode);
                view.dispatch(transaction);
            }
            
            toast.success("Uploaded!", { id: loadingToast });
        } catch (e) {
            console.error(e);
            toast.error("Upload failed", { id: loadingToast });
        }
    };

    return (
        <div className={`border border-border rounded-lg overflow-hidden h-full flex flex-col ${editable ? 'bg-surface' : 'bg-transparent border-0'}`}>
            <style>{editorStyles}</style>
            {editable && <MenuBar editor={editor} onOpenMedia={() => setIsMediaOpen(true)} />}
            <div className="flex-1 overflow-y-auto p-3 md:p-6 cursor-text" onClick={() => editor?.commands.focus()}>
                <EditorContent editor={editor} />
            </div>
            
            {isMediaOpen && (
                <MediaLibraryModal 
                    onClose={() => setIsMediaOpen(false)} 
                    onSelect={(url) => { 
                        const isImg = url.match(/\.(jpeg|jpg|gif|png|webp|svg|bmp)$/i) != null;
                        if (isImg) {
                            editor?.chain().focus().setImage({ src: url }).run();
                        } else {
                            editor?.chain().focus().insertContent(`<a href="${url}" target="_blank">📄 Attachment</a> `).run();
                        }
                        setIsMediaOpen(false); 
                    }} 
                />
            )}
        </div>
    );
};

export default RichTextEditor;
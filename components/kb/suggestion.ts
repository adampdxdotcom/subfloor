import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import ArticleList from './ArticleList';
import axios from 'axios';

export default {
  items: async ({ query }: { query: string }) => {
    // 1. Fetch suggestions from API
    // We assume /api/kb/search?q=... returns a list of articles
    if (!query) return [];
    try {
        const res = await axios.get(`/api/kb/search?q=${query}`);
        // Return top 5 results
        return res.data.slice(0, 5); 
    } catch (e) {
        console.error(e);
        return [];
    }
  },

  render: () => {
    let component: ReactRenderer;
    let popup: any;

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(ArticleList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
      },

      onUpdate(props: any) {
        component.updateProps(props);
        component.updateProps({ query: props.query });

        if (!props.clientRect) {
          return;
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
      },

      onKeyDown(props: any) {
        if (props.event.key === 'Escape') {
          popup[0].hide();
          return true;
        }
        // Pass keydown to the React component (ArticleList)
        return (component.ref as any)?.onKeyDown(props);
      },

      onExit() {
        popup[0].destroy();
        component.destroy();
      },
    };
  },
};
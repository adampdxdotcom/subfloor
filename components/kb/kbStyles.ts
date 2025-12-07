export const readStyles = `
  .kb-read-content h1 { font-size: 1.75em; font-weight: 800; margin-top: 1.5em; margin-bottom: 0.5em; color: var(--color-text-primary); scroll-margin-top: 2rem; }
  .kb-read-content h2 { font-size: 1.4em; font-weight: 700; margin-top: 1.25em; margin-bottom: 0.5em; color: var(--color-text-primary); scroll-margin-top: 2rem; }
  .kb-read-content h3 { font-size: 1.2em; font-weight: 600; margin-top: 1em; margin-bottom: 0.5em; color: var(--color-text-primary); scroll-margin-top: 2rem; }
  .kb-read-content p { margin-bottom: 0.75em; line-height: 1.6; color: var(--color-text-primary); overflow-wrap: break-word; }
  .kb-read-content p:empty::before { content: " "; display: inline-block; }
  .kb-read-content ul { list-style-type: disc; padding-left: 1.5em; margin-bottom: 1em; color: var(--color-text-primary); }
  .kb-read-content ol { list-style-type: decimal; padding-left: 1.5em; margin-bottom: 1em; color: var(--color-text-primary); }
  .kb-read-content a { color: var(--color-primary); text-decoration: underline; cursor: pointer; }
  .kb-read-content strong { font-weight: bold; color: var(--color-text-primary); }
  
  /* FILE ATTACHMENT LINKS */
  .kb-read-content a[href*="/uploads/"] {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background-color: var(--color-surface);
      border: 1px solid var(--color-border);
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      text-decoration: none;
      font-weight: 500;
      font-size: 0.9em;
      transition: all 0.2s;
      margin: 0.25rem 0;
  }
  .kb-read-content a[href*="/uploads/"]:hover {
      border-color: var(--color-primary);
      background-color: color-mix(in srgb, var(--color-primary), transparent 95%);
  }
  
  /* CAPTION & FIGURE STYLES */
  .kb-read-content figure { display: table; margin: 1.5em auto; max-width: 100%; }
  .kb-read-content figcaption { text-align: center; font-size: 0.85em; color: var(--color-text-secondary); font-style: italic; margin-top: 0.5em; width: 100%; }
  .kb-read-content figure img { margin: 0 !important; float: none !important; display: block; }
  
  /* IMAGE STYLES */
  .kb-read-content img { 
      max-width: 100%; 
      height: auto; 
      border-radius: 0.5rem; 
      margin: 1.5em auto; 
      display: block;    
      cursor: zoom-in; 
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); 
  }
  .kb-read-content img[align="left"] { 
      float: left; margin: 0.5em 1.5em 1em 0; display: inline-block; 
  }
  .kb-read-content img[align="right"] { 
      float: right; margin: 0.5em 0 1em 1.5em; display: inline-block; 
  }
  .kb-read-content img[align="center"] { display: block; margin: 1.5em auto; }
  
  /* WIKI LINKS */
  .kb-read-content .kb-mention {
      color: var(--color-primary);
      background-color: color-mix(in srgb, var(--color-primary), white 85%);
      padding: 0.1rem 0.3rem;
      border-radius: 0.3rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
  }
  .kb-read-content .kb-mention:hover {
      background-color: var(--color-primary);
      color: var(--color-on-primary);
  }
`;
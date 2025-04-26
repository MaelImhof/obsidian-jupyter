> [!INFO]
> This page is under construction, not ready to be published yet.

*Jupyter for Obsidian* offers features of embedding a notebook in a note or preview a notebook on hover of a link. You are probably familiar with those features, since they are pretty common in Obsidian plugins.

> [!TODO] Add a picture of embedding

> [!TODO] Add a picture of hover preview

I, however, had some trouble implementing these, as I did not find any significant documentation about how they work. I ended up reverse-engineering the *Excalidraw for Obsidian* plugin to understand how it was done.

I document my findings here, in the hope it will help someone (probably myself when I need to modify that code again).
## Different Cases

There are three cases to handle:
1. **Reading mode**
   By far the easiest, display the embedded notebook when the containing file is opened in reading mode.
2. **Mouse hover**
   Display a preview of the hovered file when the user moves the mouse on top of a Jupyter notebook file in the file explorer, or on top of a link in a document.
3. **Live Preview mode**
   > [!TODO] Find how to do this
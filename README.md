# CodeMirror Color Picker

A codemirror extension that adds a color picker input next to CSS color values

![preview](https://replit.com/cdn-cgi/image/width=3840,quality=80/https://storage.googleapis.com/replit/images/1632627522442_46320608eaa3f0c58bebd5fe4a10efc2.gif)

### Usage

```ts
import {basicSetup, EditorState} from '@codemirror/basic-setup';
import {EditorView} from '@codemirror/view';
import {cssLanguage, cssCompletion} from '@codemirror/lang-css';
import {cssColorPicker} from '@replit/codemirror-css-color-picker';

const css = new LanguageSupport(cssLanguage, [cssCompletion, cssColorPicker]);

new EditorView({
  state: EditorState.create({
    doc: '.wow {\n  color: #fff;\n}',
    extensions: [basicSetup, css],
  }),
  parent: document.querySelector('#editor'),
});

```

### Todos 

- Handle `hsl()` function notation.
- Handle keyword notation i.e. `green`.
- Consider re-setting values to original notation, right now `rgb()` turns into hex when changed.
- Investigate solutions for alpha values. `input[type="color"]` doesn't support alpha values, we could show another number input next to it for the alpha value.


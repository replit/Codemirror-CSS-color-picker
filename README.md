# CodeMirror Color Picker

A codemirror extension that adds a color picker input next to CSS color values

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


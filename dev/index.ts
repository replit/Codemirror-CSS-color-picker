import { basicSetup, EditorState } from '@codemirror/basic-setup';
import { css } from '@codemirror/lang-css';
import { EditorView } from '@codemirror/view';
import { colorPicker } from "../src/"

const doc = `
.wow {
  color: #ff0000;
  border-color: rgb(0, 255, 0%);
  background-color: #00f;
}

#alpha {
  color: #FF00FFAA;
  border-color: rgb(255, 50%, 64, 0.5);
}

.hex4 {
  color: #ABCD;
}

.named {
  color: red;
  background-color: blue;
  border-top-color: aquamarine;
  border-left-color: mediumaquamarine;
  border-right-color: lightcoral;
  border-bottom-color: snow;
}

#hue {
  color: hsl(0, 100%, 50%);
}
`

new EditorView({
  state: EditorState.create({
    doc,
    extensions: [colorPicker, basicSetup, css()],
  }),
  parent: document.querySelector('#editor'),
});

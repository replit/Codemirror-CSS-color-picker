import { basicSetup, EditorState } from '@codemirror/basic-setup';
import { css } from '@codemirror/lang-css';
import { EditorView } from '@codemirror/view';
import { colorPicker } from "../src/"

const doc = `
.wow {
  color: #ff0000;
  border-color: rgb(0, 255, 0);
  background-color: #00f;
}

#alpha {
  border-color: rgb(255, 128, 64, 0.5);
}
`

new EditorView({
  state: EditorState.create({
    doc,
    extensions: [colorPicker, basicSetup, css()],
  }),
  parent: document.querySelector('#editor'),
});

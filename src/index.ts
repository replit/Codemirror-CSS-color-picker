import {
  EditorView,
  WidgetType,
  ViewUpdate,
  ViewPlugin,
  DecorationSet,
  Decoration,
} from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { Range } from '@codemirror/rangeset';
import { namedColors } from './named-colors';

enum ColorType {
  rgb = "RGB",
  hex = "HEX",
  named = "NAMED"
};

const rgbCallExpRegex = /rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(,\s*0?\.\d+)?\)/;

function colorPickersDecorations(view: EditorView) {
  const widgets: Array<Range<Decoration>> = [];

  for (const range of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from: range.from,
      to: range.to,
      enter: (type, from, to) => {
        if (type.name === 'CallExpression') {
          const callExp = view.state.doc.sliceString(from, to);
          const match = rgbCallExpRegex.exec(callExp);

          if (!match) {
            return;
          }

          const [_, r, g, b, a] = match;
          const color = rgbToHex(Number(r), Number(g), Number(b));

          const d = Decoration.widget({
            widget: new ColorPickerWidget(ColorType.rgb, color, from, to, a || ''),
            side: 1,
          });

          widgets.push(d.range(to));

          return;
        }

        if (type.name === 'ColorLiteral') {
          const [color, alpha] = toFullHex(view.state.doc.sliceString(from, to));

          const d = Decoration.widget({
            widget: new ColorPickerWidget(ColorType.hex, color, from, to, alpha),
            side: 1,
          });

          widgets.push(d.range(to));
        }

        if (type.name === 'ValueName') {
          const colorName = view.state.doc.sliceString(from, to);
          if (namedColors.has(colorName)) {
            const color = namedColors.get(colorName);
            const d = Decoration.widget({
              widget: new ColorPickerWidget(ColorType.named, color, from, to, ''),
              side: 1,
            });

            widgets.push(d.range(to));
          }
        }
      },
    });
  }

  return Decoration.set(widgets);
}

function toFullHex(color: string): string[] {
  if (color.length === 4) { // 3-char hex
    return [ `#${color[1].repeat(2)}${color[2].repeat(2)}${color[3].repeat(2)}`, ''];
  }

  if (color.length === 5) { // 4-char hex (alpha)
    return [ `#${color[1].repeat(2)}${color[2].repeat(2)}${color[3].repeat(2)}`, color[4].repeat(2)];
  }

  if (color.length === 9) { // 8-char hex (alpha)
    return [ `#${color.slice(1, -2)}`, color.slice(-2)];
  }

  return [color, ''];
}

function rgbComponentToHex(component: number): string {
  const hex = component.toString(16);

  return hex.length == 1 ? '0' + hex : hex;
}

function hexToRGBComponents(hex: string): number[] {
  const r = hex.slice(1, 3);
  const g = hex.slice(3, 5);
  const b = hex.slice(5, 7);
  return [ parseInt(r, 16), parseInt(g, 16), parseInt(b, 16) ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${rgbComponentToHex(r)}${rgbComponentToHex(g)}${rgbComponentToHex(b)}`;
}

export const wrapperClassName = 'cm-css-color-picker-wrapper';

class ColorPickerWidget extends WidgetType {
  constructor(
    readonly colorType: ColorType,
    readonly color: string,
    readonly from: number,
    readonly to: number,
    readonly alpha: string,
  ) {
    super();
  }

  eq(other: ColorPickerWidget) {
    return (
      other.colorType === this.colorType &&
      other.color === this.color &&
      other.from === this.from &&
      other.to === this.to &&
      other.alpha === this.alpha
    );
  }

  toDOM() {
    const picker = document.createElement('input');
    picker.dataset.from = this.from.toString();
    picker.dataset.to = this.to.toString();
    picker.dataset.alpha = this.alpha;
    picker.dataset.colorType = this.colorType;
    picker.type = 'color';
    picker.value = this.color;

    const wrapper = document.createElement('span');
    wrapper.appendChild(picker);
    wrapper.className = wrapperClassName;

    return wrapper;
  }

  ignoreEvent() {
    return false;
  }
}

export const colorPicker = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = colorPickersDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = colorPickersDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    eventHandlers: {
      change: (e, view) => {
        const target = e.target as HTMLInputElement;
        if (
          target.nodeName !== 'INPUT' ||
          !target.parentElement ||
          !target.parentElement.classList.contains(wrapperClassName)
        ) {
          return false;
        }

        let converted = target.value + target.dataset.alpha;
        if (target.dataset.colorType === ColorType.rgb) {
          converted = `rgb(${hexToRGBComponents(target.value).join(', ')}${target.dataset.alpha})`;
        } else if (target.dataset.colorType === ColorType.named) {
          // If the hex is an exact match for another named color, prefer retaining name
          for (const [key, value] of namedColors.entries()) {
            if (value === target.value)
              converted = key;
          }
        }
        view.dispatch({
          changes: {
            from: Number(target.dataset.from),
            to: Number(target.dataset.to),
            insert: converted,
          },
        });

        return true;
      },
    },
  },
);

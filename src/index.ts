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
  named = "NAMED",
  hsl = "HSL"
};

const rgbCallExpRegex = /rgb\(\s*(\d{1,3}%?)\s*,\s*(\d{1,3}%?)\s*,\s*(\d{1,3}%?)\s*(,\s*0?\.\d+)?\)/;
const hslCallExpRegex = /hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*(,\s*0?\.\d+)?\)/;

function colorPickersDecorations(view: EditorView) {
  const widgets: Array<Range<Decoration>> = [];

  for (const range of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from: range.from,
      to: range.to,
      enter: (type, from, to) => {
        if (type.name === 'CallExpression') {
          const callExp: string = view.state.doc.sliceString(from, to);
          if (callExp.startsWith('rgb')) {
            const match = rgbCallExpRegex.exec(callExp);

            if (!match) {
              return;
            }

            const [_, r, g, b, a] = match;
            const color = rgbToHex(r, g, b);

            const d = Decoration.widget({
              widget: new ColorPickerWidget(ColorType.rgb, color, from, to, a || ''),
              side: 1,
            });

            widgets.push(d.range(to));

            return;
          }
          if (callExp.startsWith('hsl')) {
            const match = hslCallExpRegex.exec(callExp);

            if (!match) {
              return;
            }

            const [_, h, s, l, a] = match;
            const color = hslToHex(h, s, l);

            const d = Decoration.widget({
              widget: new ColorPickerWidget(ColorType.hsl, color, from, to, a || ''),
              side: 1,
            });

            widgets.push(d.range(to));

            return;
          }
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

function rgbComponentToHex(component: string): string {
  let numericValue: number;
  if (component.endsWith('%')) { // 0-100%
    const percent = Number(component.slice(0, -1));
    numericValue = Math.round((percent / 100) * 255.0);
  } else {
    numericValue = Number(component); // assume 0-255
  }
  return decimalToHex(numericValue);
}

function decimalToHex(decimal: number): string {
  const hex = decimal.toString(16);
  return hex.length == 1 ? '0' + hex : hex;
}

function hexToRGBComponents(hex: string): number[] {
  const r = hex.slice(1, 3);
  const g = hex.slice(3, 5);
  const b = hex.slice(5, 7);
  return [ parseInt(r, 16), parseInt(g, 16), parseInt(b, 16) ];
}

function rgbToHex(r: string, g: string, b: string): string {
  return `#${rgbComponentToHex(r)}${rgbComponentToHex(g)}${rgbComponentToHex(b)}`;
}

function hslToHex(h: string, s: string, l: string): string {
  const sFloat = Number(s) / 100;
  const lFloat = Number(l) / 100;
  const [r, g ,b] = hslToRGB(Number(h), sFloat, lFloat);
  return `#${decimalToHex(r)}${decimalToHex(g)}${decimalToHex(b)}`;
}

function hslToRGB(hue: number, sat: number, light: number): number[] {
  hue = hue / 60;
  let t2: number;
  if (light <= 0.5) {
    t2 = light * (sat + 1);
  } else {
    t2 = light + sat - (light * sat);
  }
  const t1 = light * 2 - t2;
  const r = hueToRgb(t1, t2, hue + 2) * 255;
  const g = hueToRgb(t1, t2, hue) * 255;
  const b = hueToRgb(t1, t2, hue - 2) * 255;
  return [ Math.round(r), Math.round(g), Math.round(b) ];
}

function hueToRgb(t1: number, t2: number, hue: number): number {
  if (hue < 0) hue += 6;
  if (hue >= 6) hue -= 6;
  if (hue < 1) return (t2 - t1) * hue + t1;
  else if(hue < 3) return t2;
  else if(hue < 4) return (t2 - t1) * (4 - hue) + t1;
  else return t1;
}

// https://www.niwa.nu/2013/05/math-behind-colorspace-conversions-rgb-hsl/
function rgbToHSL(r: number, g: number, b: number): number[] {
  const redPercent = r / 255;
  const greenPercent = g / 255;
  const bluePercent = b / 255;
  const min = Math.min(redPercent, greenPercent, bluePercent);
  const max = Math.max(redPercent, greenPercent, bluePercent);
  const luminance = (max + min) / 2;
  // If the min and max value are the same, it means that there is no saturation. ...
  // If there is no Saturation, we don’t need to calculate the Hue. So we set it to 0 degrees.
  if (max === min) {
    return [ 0, 0, luminance];
  }

  let saturation: number;
  // If Luminance is less or equal to 0.5, then Saturation = (max-min)/(max+min)
  if (luminance <= 0.5) {
    saturation = (max - min) / (max + min);
  } else { // If Luminance is bigger then 0.5. then Saturation = ( max-min)/(2.0-max-min)
    saturation = (max - min) / (2.0 - max - min);
  }

  let hue: number;
  // If Red is max, then Hue = (G-B)/(max-min)
  if (max === redPercent) {
    hue = (greenPercent - bluePercent) / (max - min);
  } else if (greenPercent === max) {
    // If Green is max, then Hue = 2.0 + (B-R)/(max-min)
    hue = 2.0 + (bluePercent - redPercent) / (max - min);
  } else {
    // If Blue is max, then Hue = 4.0 + (R-G)/(max-min)
    hue = 4.0 + (redPercent - greenPercent) / (max - min);
  }
  hue = Math.round(hue * 60); // convert to degrees
  // make hue positive angle/degrees
  while (hue < 0) {
    hue += 360;
  }
  return [ hue, saturation, luminance ];
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
        } else if (target.dataset.colorType === ColorType.hsl) {
          const [r, g, b] = hexToRGBComponents(target.value);
          const [h, s, l] = rgbToHSL(r, g, b);
          converted = `hsl(${h}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%${target.dataset.alpha})`;
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

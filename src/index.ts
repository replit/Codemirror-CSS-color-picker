import {
  EditorView,
  WidgetType,
  ViewUpdate,
  ViewPlugin,
  DecorationSet,
  Decoration,
} from '@codemirror/view';
import type { StyleSpec } from 'style-mod';
import { Extension } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { Range } from '@codemirror/rangeset';
import { namedColors } from './named-colors';

interface CSSColorPickerOptions {
  className?: string;
  style?: {
    wrapper?: StyleSpec;
    input?: StyleSpec;
  };
}
interface PickerState {
  from: number;
  to: number;
  alpha: string;
  colorType: ColorType;
}

const dataset = new WeakMap<HTMLInputElement, PickerState>();

enum ColorType {
  rgb = 'RGB',
  hex = 'HEX',
  named = 'NAMED',
  hsl = 'HSL',
}

const rgbCallExpRegex =
  /rgb\(\s*(\d{1,3}%?)\s*,?\s*(\d{1,3}%?)\s*,?\s*(\d{1,3}%?)\s*(,\s*0?\.\d+)?\)/;
const hslCallExpRegex =
  /hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*(,\s*0?\.\d+)?\)/;

function colorPickersDecorations(
  view: EditorView,
  options: CSSColorPickerOptions,
) {
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

            const widget = Decoration.widget({
              widget: new ColorPickerWidget({
                colorType: ColorType.rgb,
                color,
                from,
                to,
                alpha: a || '',
                options,
              }),
              side: 0,
            });

            widgets.push(widget.range(from));

            return;
          }
          if (callExp.startsWith('hsl')) {
            const match = hslCallExpRegex.exec(callExp);

            if (!match) {
              return;
            }

            const [_, h, s, l, a] = match;
            const color = hslToHex(h, s, l);

            const widget = Decoration.widget({
              widget: new ColorPickerWidget({
                colorType: ColorType.hsl,
                color,
                from,
                to,
                alpha: a || '',
                options,
              }),
              side: 1,
            });

            widgets.push(widget.range(from));

            return;
          }
        }

        if (type.name === 'ColorLiteral') {
          const [color, alpha] = toFullHex(
            view.state.doc.sliceString(from, to),
          );

          const widget = Decoration.widget({
            widget: new ColorPickerWidget({
              colorType: ColorType.hex,
              color,
              from,
              to,
              alpha,
              options,
            }),
            side: 1,
          });

          widgets.push(widget.range(from));
        }

        if (type.name === 'ValueName') {
          const colorName = view.state.doc.sliceString(from, to);
          if (namedColors.has(colorName)) {
            const color = namedColors.get(colorName);
            const widget = Decoration.widget({
              widget: new ColorPickerWidget({
                colorType: ColorType.named,
                color,
                from,
                to,
                alpha: '',
                options,
              }),
              side: 1,
            });

            widgets.push(widget.range(from));
          }
        }
      },
    });
  }

  return Decoration.set(widgets);
}

function toFullHex(color: string): string[] {
  if (color.length === 4) {
    // 3-char hex
    return [
      `#${color[1].repeat(2)}${color[2].repeat(2)}${color[3].repeat(2)}`,
      '',
    ];
  }

  if (color.length === 5) {
    // 4-char hex (alpha)
    return [
      `#${color[1].repeat(2)}${color[2].repeat(2)}${color[3].repeat(2)}`,
      color[4].repeat(2),
    ];
  }

  if (color.length === 9) {
    // 8-char hex (alpha)
    return [`#${color.slice(1, -2)}`, color.slice(-2)];
  }

  return [color, ''];
}

function rgbComponentToHex(component: string): string {
  let numericValue: number;
  if (component.endsWith('%')) {
    // 0-100%
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
  return [parseInt(r, 16), parseInt(g, 16), parseInt(b, 16)];
}

function rgbToHex(r: string, g: string, b: string): string {
  return `#${rgbComponentToHex(r)}${rgbComponentToHex(g)}${rgbComponentToHex(
    b,
  )}`;
}

function hslToHex(h: string, s: string, l: string): string {
  const sFloat = Number(s) / 100;
  const lFloat = Number(l) / 100;
  const [r, g, b] = hslToRGB(Number(h), sFloat, lFloat);
  return `#${decimalToHex(r)}${decimalToHex(g)}${decimalToHex(b)}`;
}

function hslToRGB(
  hue: number,
  saturation: number,
  luminance: number,
): number[] {
  // If there is no Saturation it means that it’s a shade of grey.
  // So in that case we just need to convert the Luminance and set R,G and B to that level.
  if (saturation === 0) {
    const value = Math.round(luminance * 255);
    return [value, value, value];
  }

  let temp1: number;
  // If Luminance is smaller then 0.5 (50%) then temporary_1 = Luminance x (1.0+Saturation)
  if (luminance < 0.5) {
    temp1 = luminance * (1.0 + saturation);
  } else {
    // If Luminance is equal or larger then 0.5 (50%) then temporary_1 = Luminance + Saturation – Luminance x Saturation
    temp1 = luminance + saturation - luminance * saturation;
  }

  // temporary_2 = 2 x Luminance – temporary _1
  const temp2 = 2 * luminance - temp1;

  // The next step is to convert the 360 degrees in a circle to 1 by dividing the angle by 360.
  hue = hue / 360.0;

  // And now we need another temporary variable for each color channel, temporary_R, temporary_G and temporary_B.
  // All values need to be between 0 and 1. In our case all the values are between 0 and 1
  const tempR = clamp(hue + 0.333);
  const tempG = hue;
  const tempB = clamp(hue - 0.333);

  const red = hueToRGB(temp1, temp2, tempR);
  const green = hueToRGB(temp1, temp2, tempG);
  const blue = hueToRGB(temp1, temp2, tempB);
  return [
    Math.round(red * 255),
    Math.round(green * 255),
    Math.round(blue * 255),
  ];
}

// If you get a negative value you need to add 1 to it.
// If you get a value above 1 you need to subtract 1 from it.
function clamp(num: number): number {
  if (num < 0) {
    return num + 1;
  }
  if (num > 1) {
    return num - 1;
  }
  return num;
}

/**
 * Now we need to do up to 3 tests to select the correct formula for each color channel. Let’s start with Red.
 *
 * test 1 – If 6 x temporary_R is smaller then 1, Red = temporary_2 + (temporary_1 – temporary_2) x 6 x temporary_R
 * In the case the first test is larger then 1 check the following
 *
 * test 2 – If 2 x temporary_R is smaller then 1, Red = temporary_1
 * In the case the second test also is larger then 1 do the following
 *
 * test 3 – If 3 x temporary_R is smaller then 2, Red = temporary_2 + (temporary_1 – temporary_2) x (0.666 – temporary_R) x 6
 * In the case the third test also is larger then 2 you do the following
 *
 * Red = temporary_2
 */
function hueToRGB(temp1: number, temp2: number, tempHue: number): number {
  if (6 * tempHue < 1) {
    return temp2 + (temp1 - temp2) * 6 * tempHue;
  }
  if (2 * tempHue < 1) {
    return temp1;
  }
  if (3 * tempHue < 2) {
    return temp2 + (temp1 - temp2) * (0.666 - tempHue) * 6;
  }
  return temp2;
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
    return [0, 0, luminance];
  }

  let saturation: number;
  // If Luminance is less or equal to 0.5, then Saturation = (max-min)/(max+min)
  if (luminance <= 0.5) {
    saturation = (max - min) / (max + min);
  } else {
    // If Luminance is bigger then 0.5. then Saturation = ( max-min)/(2.0-max-min)
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
  return [hue, saturation, luminance];
}

export const wrapperClassName = 'cm-css-color-picker-wrapper';

class ColorPickerWidget extends WidgetType {
  private readonly state: PickerState;
  private readonly color: string;
  private readonly options: CSSColorPickerOptions;

  constructor({
    color,
    options,
    ...state
  }: PickerState & {
    color: string;
    options: CSSColorPickerOptions;
  }) {
    super();
    this.state = state;
    this.color = color;
    this.options = options;
  }

  eq(other: ColorPickerWidget) {
    return (
      other.state.colorType === this.state.colorType &&
      other.color === this.color &&
      other.state.from === this.state.from &&
      other.state.to === this.state.to &&
      other.state.alpha === this.state.alpha &&
      other.options.style?.wrapper === this.options.style?.wrapper &&
      other.options.style?.input === this.options.style?.input
    );
  }

  toDOM() {
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = this.color;

    const { className } = this.options;
    if (className) {
      picker.classList.add(className);
    }

    dataset.set(picker, this.state);

    const wrapper = document.createElement('span');
    wrapper.appendChild(picker);
    wrapper.className = wrapperClassName;

    return wrapper;
  }

  ignoreEvent() {
    return false;
  }
}

const colorPickerTheme = ({ style }: CSSColorPickerOptions) =>
  EditorView.theme({
    [`.${wrapperClassName}`]: {
      display: 'inline-block',
      outline: '1px solid #eee',
      marginRight: '0.6ch',
      height: '1em',
      width: '1em',
      transform: 'translateY(1px)',
      ...style.wrapper,
    },
    [`.${wrapperClassName} input[type="color"]`]: {
      cursor: 'pointer',
      height: '100%',
      width: '100%',
      padding: 0,
      border: 'none',
      '&::-webkit-color-swatch-wrapper': {
        padding: 0,
      },
      '&::-webkit-color-swatch': {
        border: 'none',
      },
      '&::-moz-color-swatch': {
        border: 'none',
      },
      ...style.input,
    },
  });

const colorPickerViewPlugin = (options: CSSColorPickerOptions) =>
  ViewPlugin.fromClass(
    class ColorPickerViewPlugin {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = colorPickersDecorations(view, options);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = colorPickersDecorations(update.view, options);
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

          const data = dataset.get(target)!;

          let converted = target.value + data.alpha;
          if (data.colorType === ColorType.rgb) {
            converted = `rgb(${hexToRGBComponents(target.value).join(', ')}${
              data.alpha
            })`;
          } else if (data.colorType === ColorType.named) {
            // If the hex is an exact match for another named color, prefer retaining name
            for (const [key, value] of namedColors.entries()) {
              if (value === target.value) converted = key;
            }
          } else if (data.colorType === ColorType.hsl) {
            const [r, g, b] = hexToRGBComponents(target.value);
            const [h, s, l] = rgbToHSL(r, g, b);
            converted = `hsl(${h}, ${Math.round(s * 100)}%, ${Math.round(
              l * 100,
            )}%${data.alpha})`;
          }

          view.dispatch({
            changes: {
              from: data.from,
              to: data.to,
              insert: converted,
            },
          });

          return true;
        },
      },
    },
  );

export const colorPicker = (options: CSSColorPickerOptions = {}): Extension => [
  colorPickerViewPlugin(options),
  colorPickerTheme(options),
];

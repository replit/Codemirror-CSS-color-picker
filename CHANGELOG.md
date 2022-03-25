# 0.19.7

### Breaking Changes

```diff
- export const colorPicker: Extension;
+ export const colorPicker = (options?: CSSColorPickerOptions) => Extension;
```

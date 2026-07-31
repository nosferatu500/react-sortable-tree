export const classnames = (...classes: string[]): string =>
  classes.filter(Boolean).join(' ')

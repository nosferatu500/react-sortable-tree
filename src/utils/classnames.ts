// very simple className utility for creating a classname string...
// Falsy arguments are ignored:
//
// const active = true
// const className = classnames(
//    "class1",
//    !active && "class2",
//    active && "class3"
// ); // returns -> class1 class3";
//
// Use Boolean constructor as a filter callback
// Allows for loose type truthy/falsey checks
// Boolean("") === false;
// Boolean(false) === false;
// Boolean(undefined) === false;
// Boolean(null) === false;
// Boolean(0) === false;
// Boolean("classname") === true;
export const classnames = (...classes: string[]) => classes.filter(Boolean).join(" ");

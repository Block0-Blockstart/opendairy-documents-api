//anything that is a Class will fulfill this type
//we can use it to check the type passed to the decorator (typescript currently does not allow more typings with decorators)
export interface IClass {
  // eslint-disable-next-line @typescript-eslint/ban-types
  new (...args: any[]): {};
}

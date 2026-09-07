declare module 'react' {
  export function createElement(type: unknown, props?: unknown, ...children: unknown[]): unknown
  export function useCallback<T extends (...args: any[]) => unknown>(callback: T, dependencies: unknown[]): T
  export function useEffect(effect: () => void | (() => void), dependencies?: unknown[]): void
  export function useState<T>(initial: T): [T, (value: T) => void]
}

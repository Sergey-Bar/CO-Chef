import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return (
      <section className="card p-8 space-y-4" role="alert">
        <h1 className="text-xl font-semibold">משהו השתבש בטעינת העמוד</h1>
        <p className="text-muted">נסו לטעון מחדש כדי להמשיך.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>טעינה מחדש</button>
      </section>
    )
    return this.props.children
  }
}

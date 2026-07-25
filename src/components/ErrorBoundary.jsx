import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("Erro não tratado capturado pelo ErrorBoundary:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-sky-50 p-6 dark:bg-slate-950">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow dark:bg-slate-900">
            <div className="mb-3 text-3xl">⚠️</div>
            <h1 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
              Algo deu errado
            </h1>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
              Ocorreu um erro inesperado no aplicativo. Seus dados estão salvos
              normalmente no servidor — recarregue a página para continuar.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

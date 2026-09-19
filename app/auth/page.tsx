export default function AuthCodeError() {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-red-600">Error de autenticación</h1>
          <p className="mt-2 text-gray-600">No se pudo completar el inicio de sesión con Google.</p>
          <a href="/" className="mt-4 inline-block rounded-xl bg-green-600 px-6 py-2 text-white">Volver a intentar</a>
        </div>
      </div>
    )
  }
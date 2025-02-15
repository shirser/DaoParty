import ConnectWallet from "@/components/ConnectWallet";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="p-6 bg-white rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">Добро пожаловать в DAO Party!</h1>
        <p className="text-gray-600 mb-4">Подключите свой кошелек, чтобы начать.</p>
        <ConnectWallet />
      </div>
    </main>
  );
}

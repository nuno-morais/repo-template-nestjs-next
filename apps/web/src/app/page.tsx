import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-6 sm:p-8">
      <h1 className="text-2xl font-semibold">sample-project</h1>
      <p className="mt-4">
        <Link href="/widgets" className="underline">
          Go to widgets
        </Link>
      </p>
    </main>
  );
}

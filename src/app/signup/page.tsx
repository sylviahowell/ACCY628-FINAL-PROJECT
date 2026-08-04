import Link from "next/link";
import { signUp } from "@/lib/actions/auth";
import { ThemeSelector } from "@/components/ThemeSelector";

export default function SignUpPage() {
  return (
    <div className="freight-hero flex min-h-screen items-center justify-center px-4 py-10 text-white">
      <div className="absolute right-4 top-4">
        <div className="rounded-box bg-base-100/10 p-1 backdrop-blur">
          <ThemeSelector compact />
        </div>
      </div>
      <div className="card w-full max-w-md bg-base-100 text-base-content shadow-2xl">
        <div className="card-body">
          <h1 className="card-title">Create your FreightFlow account</h1>
          <p className="text-sm opacity-70">
            Sign up with Supabase Auth. Your role controls what you can see.
          </p>
          <form action={signUp} className="mt-2 space-y-3">
            <input
              name="full_name"
              required
              placeholder="Full name"
              className="input input-bordered w-full"
            />
            <input
              name="email"
              type="email"
              required
              placeholder="Email"
              className="input input-bordered w-full"
            />
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="Password (min 8 characters)"
              className="input input-bordered w-full"
            />
            <select name="role" className="select select-bordered w-full" defaultValue="broker">
              <option value="broker">Broker / Dispatcher</option>
              <option value="manager">Manager</option>
              <option value="customer">Customer</option>
              <option value="carrier">Carrier</option>
            </select>
            <button type="submit" className="btn btn-primary w-full">
              Sign up
            </button>
          </form>
          <p className="text-sm">
            Already have an account?{" "}
            <Link href="/login" className="link link-primary">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

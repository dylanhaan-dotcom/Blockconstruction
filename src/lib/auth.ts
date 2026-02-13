import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { queryOne } from "./db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await queryOne(
          "SELECT * FROM users WHERE email = ?",
          [credentials.email as string]
        );

        if (!user || !user.password_hash) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password_hash as string
        );

        if (!valid) return null;

        return {
          id: String(user.id),
          name: user.name as string,
          email: user.email as string,
          role: user.role as string,
          trade_type: user.trade_type as string | null,
          license_info: (user.license_info as string | null) || null,
          insurance_info: (user.insurance_info as string | null) || null,
          rating: Number(user.rating) || 0,
          rating_count: Number(user.rating_count) || 0,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as Record<string, unknown>).role;
        token.trade_type = (user as Record<string, unknown>).trade_type;
        token.license_info = (user as Record<string, unknown>).license_info;
        token.insurance_info = (user as Record<string, unknown>).insurance_info;
        token.rating = (user as Record<string, unknown>).rating;
        token.rating_count = (user as Record<string, unknown>).rating_count;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = session.user as any;
        u.id = token.id;
        u.role = token.role;
        u.trade_type = token.trade_type;
        u.license_info = token.license_info;
        u.insurance_info = token.insurance_info;
        u.rating = token.rating;
        u.rating_count = token.rating_count;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});

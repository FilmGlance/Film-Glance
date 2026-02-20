// app/layout.tsx
export const metadata = {
  title: "Film Glance — Every Film. One Rating at a Glance.",
  description: "Search any movie and see the averaged score across 10 major review sites.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "#050505" }}>
        {children}
      </body>
    </html>
  );
}

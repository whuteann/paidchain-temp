import type { GetServerSideProps } from "next";

export default function PayoutDetailPage() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: "/dashboard", permanent: false },
});

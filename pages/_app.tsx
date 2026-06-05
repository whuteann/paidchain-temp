import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { CustomersProvider } from "@/components/customers-context";
import { JobSlaProvider } from "@/components/job-sla-context";
import { MerchantsProvider } from "@/components/merchants-context";
import { JobsProvider } from "@/components/jobs-context";
import { PayoutsProvider } from "@/components/payouts-context";
import { RentalsProvider } from "@/components/rentals-context";
import { SimCardsProvider } from "@/components/simcards-context";
import { TerminalsProvider } from "@/components/terminals-context";
import { PaperRollsProvider } from "@/components/paper-rolls-context";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <JobSlaProvider>
      <CustomersProvider>
        <MerchantsProvider>
          <JobsProvider>
            <PayoutsProvider>
              <RentalsProvider>
                <TerminalsProvider>
                  <SimCardsProvider>
                    <PaperRollsProvider>
                      <Component {...pageProps} />
                    </PaperRollsProvider>
                  </SimCardsProvider>
                </TerminalsProvider>
              </RentalsProvider>
            </PayoutsProvider>
          </JobsProvider>
        </MerchantsProvider>
      </CustomersProvider>
    </JobSlaProvider>
  );
}

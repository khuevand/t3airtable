import { type AppType } from "next/app";
import { Geist } from "next/font/google";

import { api } from "~/utils/api";

import "~/styles/globals.css";
import {
  ClerkProvider,
} from '@clerk/nextjs'
import { dark, neobrutalism } from '@clerk/themes'

const geist = Geist({
  subsets: ["latin"],
});

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <ClerkProvider appearance={{
        baseTheme: neobrutalism,
      }}>
      <Component {...pageProps} />
  </ClerkProvider>  
  );
};

export default api.withTRPC(MyApp);

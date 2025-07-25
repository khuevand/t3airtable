import { type AppType } from "next/app";
import { Geist } from "next/font/google";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
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
  <ClerkProvider
    appearance={{
      baseTheme: neobrutalism,
    }}
  >
    <div>
      <Component {...pageProps} />
      <ToastContainer position="bottom-left" />
    </div>
  </ClerkProvider>
);

};

export default api.withTRPC(MyApp);

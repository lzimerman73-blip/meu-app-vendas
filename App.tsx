import "react-native-gesture-handler";
import React from "react";
import { Provider as PaperProvider, MD3LightTheme } from "react-native-paper";
import { Routes } from "./src/routes";

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#005492",
  },
};

export default function App() {
  return (
    <PaperProvider theme={theme}>
      <Routes />
    </PaperProvider>
  );
}

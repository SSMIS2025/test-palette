import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-2 group-[.toaster]:border-primary/30 group-[.toaster]:shadow-2xl group-[.toaster]:backdrop-blur-sm",
          description: "group-[.toast]:text-foreground group-[.toast]:font-bold group-[.toast]:text-base",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:font-bold",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          title: "group-[.toast]:font-bold group-[.toast]:text-lg",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };

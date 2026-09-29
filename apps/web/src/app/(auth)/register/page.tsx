"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { createClient } from "@/lib/supabase/client";
import { registerSchema } from "@/lib/schemas";

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setBusy(true);
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}${base}/proyectos/` },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // con confirmación de email activa no hay sesión hasta que confirme
    if (!data.session) setSent(true);
  });

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revisá tu email</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p>Te enviamos un enlace para confirmar la cuenta. Después podés ingresar.</p>
          <Link href="/login" className="font-medium underline">
            Ir a ingresar
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crear cuenta</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" autoComplete="email" className="h-11" {...register("email")} />
          </Field>
          <Field label="Contraseña" error={errors.password?.message}>
            <Input type="password" autoComplete="new-password" className="h-11" {...register("password")} />
          </Field>
          <Field label="Repetir contraseña" error={errors.confirm?.message}>
            <Input type="password" autoComplete="new-password" className="h-11" {...register("confirm")} />
          </Field>
          <Button type="submit" size="lg" className="h-12 text-base" disabled={busy}>
            Registrarme
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" className="font-medium text-foreground underline">
              Ingresar
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

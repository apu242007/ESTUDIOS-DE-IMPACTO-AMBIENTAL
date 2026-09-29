"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { useAuth } from "@/lib/auth/auth-provider";
import { createOrganization } from "@/lib/data/admin";
import { errMsg } from "@/lib/data/util";
import { orgSchema } from "@/lib/schemas";

type OrgValues = z.infer<typeof orgSchema>;

export default function OnboardingPage() {
  const { session, loading, refreshMemberships, setOrgId, signOut } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrgValues>({ resolver: zodResolver(orgSchema) });

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  const onSubmit = handleSubmit(async ({ name }) => {
    setBusy(true);
    try {
      const id = await createOrganization(name);
      await refreshMemberships();
      setOrgId(id);
      router.replace("/proyectos");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crear organización</CardTitle>
        <CardDescription>
          Es tu consultora: ahí vivirán tus clientes, proyectos y usuarios. Vos quedás como administrador.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label="Nombre de la organización" error={errors.name?.message}>
            <Input className="h-11" {...register("name")} />
          </Field>
          <Button type="submit" size="lg" className="h-12 text-base" disabled={busy}>
            Crear y continuar
          </Button>
          <Button type="button" variant="ghost" onClick={() => void signOut()}>
            Salir
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

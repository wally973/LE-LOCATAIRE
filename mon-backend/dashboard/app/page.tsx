"use client";

import Link from "next/link";
import { Building2, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  const { user, loading } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-muted/40 p-6">
      <div className="mx-auto max-w-xl text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
          Next.js 14 · NestJS JWT · Contrôle par rôle
        </p>
        <h1 className="text-balance text-4xl font-bold tracking-tight">
          Plateforme gestionnaire et locataires
        </h1>
        <p className="mt-3 text-muted-foreground">
          Connexion obligatoire pour les espaces protégés. Les menus s’adaptent à
          votre rôle (LOCATAIRE, BAILLEUR, ADMIN).
        </p>
        {!loading && user ? (
          <p className="mt-4 text-sm">
            Connecté en tant que{" "}
            <Badge variant="secondary">{user.role}</Badge>{" "}
            {user.email ? `— ${user.email}` : null}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-center gap-6">
        <Card className="w-[320px] overflow-hidden shadow-md">
          <CardHeader className="flex flex-row items-center gap-4">
            <span className="rounded-full bg-primary/10 p-3 text-primary">
              <User className="h-8 w-8" aria-hidden />
            </span>
            <div>
              <CardTitle>Espace locataire</CardTitle>
              <CardDescription>
                Réservé aux comptes{" "}
                <span className="font-medium">LOCATAIRE</span> (et ADMIN).
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pb-6">
            <Link href="/locataire/dashboard">
              <Button size="lg" className="w-full">
                Portail locataire
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="w-[320px] overflow-hidden shadow-md">
          <CardHeader className="flex flex-row items-center gap-4">
            <span className="rounded-full bg-primary/10 p-3 text-primary">
              <Building2 className="h-8 w-8" aria-hidden />
            </span>
            <div>
              <CardTitle>Espace gestionnaire</CardTitle>
              <CardDescription>
                Réservé aux comptes{" "}
                <span className="font-medium">BAILLEUR</span> (et ADMIN).
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pb-6">
            <Link href="/bailleur/dashboard">
              <Button size="lg" variant="secondary" className="w-full">
                Portail bailleur
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="w-[320px] overflow-hidden shadow-md">
          <CardHeader className="flex flex-row items-center gap-4">
            <span className="rounded-full bg-primary/10 p-3 text-primary">
              <Shield className="h-8 w-8" aria-hidden />
            </span>
            <div>
              <CardTitle>Plateforme</CardTitle>
              <CardDescription>
                Première connexion ? Utilisez le compte seed ADMIN puis créez vos
                utilisateurs via POST /auth/register (JWT admin).
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pb-6">
            <Link href="/login">
              <Button variant="outline" size="lg" className="w-full">
                Page de connexion
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

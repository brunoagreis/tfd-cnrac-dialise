import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Building2, FileText, Lock, Settings, Users } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Activity className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">NEXUS</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/auth/login">
              <Button variant="outline">Entrar</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Sistema Integrado de Gestão
          <span className="block text-primary">Municipal da Saúde</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Solução completa e modular para gestão hospitalar, laboratorial, regulação, faturamento e muito mais.
          Desenvolvido para o SUS.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href="/auth/login">
            <Button size="lg" className="gap-2">
              <Lock className="h-4 w-4" />
              Acessar Sistema
            </Button>
          </Link>
          <Link href="#modulos">
            <Button size="lg" variant="outline">
              Conhecer Módulos
            </Button>
          </Link>
        </div>
      </section>

      {/* Módulos */}
      <section id="modulos" className="container mx-auto px-4 py-16">
        <h2 className="mb-8 text-center text-3xl font-bold">Módulos do Sistema</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <Settings className="h-8 w-8 text-primary" />
              <CardTitle>CORE</CardTitle>
              <CardDescription>Multi-tenant, RBAC, Logs e Auditoria</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Base do sistema com controle de acesso granular, logs imutáveis e gestão de múltiplos municípios.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-8 w-8 text-primary" />
              <CardTitle>MPI</CardTitle>
              <CardDescription>Paciente Único e Deduplicação</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Master Patient Index para identificação única e unificação de registros de pacientes.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Building2 className="h-8 w-8 text-primary" />
              <CardTitle>HOSP</CardTitle>
              <CardDescription>Gestão Hospitalar Completa</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Recepção, classificação Manchester, ADT, prontuário SOAP, prescrição e checagem.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Activity className="h-8 w-8 text-primary" />
              <CardTitle>LAB + IMAG</CardTitle>
              <CardDescription>Laboratório e Imagens</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                LIS para laboratório e RIS/PACS para exames de imagem, com integração municipal.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <FileText className="h-8 w-8 text-primary" />
              <CardTitle>REG + TFD + JUD</CardTitle>
              <CardDescription>Regulação e Processos</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Regulação de vagas, TFD e judicialização com controle de prazos e notificações.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Settings className="h-8 w-8 text-primary" />
              <CardTitle>E muito mais...</CardTitle>
              <CardDescription>+15 módulos especializados</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Farmácia, Logística, Faturamento, Ouvidoria, BI, Portal do Cidadão e outros módulos SUS.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>NEXUS - Sistema Integrado de Gestão Municipal da Saúde</p>
          <p className="mt-2">Desenvolvido para o SUS</p>
        </div>
      </footer>
    </div>
  )
}

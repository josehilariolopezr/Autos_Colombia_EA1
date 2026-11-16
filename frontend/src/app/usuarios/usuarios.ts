import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RolUsuario, Usuario, UsuarioActualizar, UsuarioCrear } from '../models/usuario';
import { UsuariosService } from '../services/usuarios.service';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.css',
})
export class Usuarios implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly usuariosService = inject(UsuariosService);

  readonly usuarios = signal<Usuario[]>([]);
  readonly total = signal(0);
  readonly offset = signal(0);
  readonly limit = signal(10);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  // Filters
  readonly searchTerm = signal('');
  readonly selectedRol = signal<'TODOS' | RolUsuario>('TODOS');
  readonly selectedActivo = signal<'TODOS' | 'ACTIVO' | 'INACTIVO'>('TODOS');

  // Modal state
  readonly showModal = signal(false);
  readonly isEditing = signal(false);
  readonly editingUser = signal<Usuario | null>(null);
  readonly submitting = signal(false);
  readonly modalError = signal<string | null>(null);

  // Deactivate modal state
  readonly showDeactivateModal = signal(false);
  readonly targetUser = signal<Usuario | null>(null);

  readonly userForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    documento: ['', [Validators.required, Validators.minLength(3)]],
    correo: ['', [Validators.required, Validators.email]],
    rol: ['OPERADOR' as RolUsuario, Validators.required],
    password: [''],
    operador_id: [null as number | null],
    activo: [true],
  });

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.loading.set(true);
    this.error.set(null);

    const activoParam =
      this.selectedActivo() === 'ACTIVO'
        ? true
        : this.selectedActivo() === 'INACTIVO'
          ? false
          : null;

    this.usuariosService
      .list(
        this.offset(),
        this.limit(),
        this.searchTerm(),
        this.selectedRol(),
        activoParam
      )
      .subscribe({
        next: (res) => {
          this.usuarios.set(res.items);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(
            err.error?.detail || 'Error al cargar el listado de usuarios.'
          );
        },
      });
  }

  onSearch(term: string) {
    this.searchTerm.set(term);
    this.offset.set(0);
    this.loadUsers();
  }

  onRolChange(rol: string) {
    this.selectedRol.set(rol as 'TODOS' | RolUsuario);
    this.offset.set(0);
    this.loadUsers();
  }

  onActivoChange(activo: string) {
    this.selectedActivo.set(activo as 'TODOS' | 'ACTIVO' | 'INACTIVO');
    this.offset.set(0);
    this.loadUsers();
  }

  prevPage() {
    if (this.offset() > 0) {
      this.offset.update((prev) => Math.max(0, prev - this.limit()));
      this.loadUsers();
    }
  }

  nextPage() {
    if (this.offset() + this.limit() < this.total()) {
      this.offset.update((prev) => prev + this.limit());
      this.loadUsers();
    }
  }

  openCreateModal() {
    this.isEditing.set(false);
    this.editingUser.set(null);
    this.modalError.set(null);
    this.userForm.reset({
      nombre: '',
      documento: '',
      correo: '',
      rol: 'OPERADOR',
      password: '',
      operador_id: null,
      activo: true,
    });
    this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    this.userForm.get('password')?.updateValueAndValidity();
    this.showModal.set(true);
  }

  openEditModal(user: Usuario) {
    this.isEditing.set(true);
    this.editingUser.set(user);
    this.modalError.set(null);
    this.userForm.reset({
      nombre: user.nombre,
      documento: user.documento,
      correo: user.correo,
      rol: user.rol,
      password: '',
      operador_id: user.operador_id,
      activo: user.activo,
    });
    // En edición la contraseña es opcional
    this.userForm.get('password')?.clearValidators();
    this.userForm.get('password')?.setValidators([Validators.minLength(6)]);
    this.userForm.get('password')?.updateValueAndValidity();
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.modalError.set(null);
  }

  submitUser() {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.modalError.set(null);

    const val = this.userForm.getRawValue();

    if (this.isEditing()) {
      const user = this.editingUser();
      if (!user) return;

      const updateData: UsuarioActualizar = {
        nombre: val.nombre?.trim(),
        documento: val.documento?.trim(),
        correo: val.correo?.trim(),
        rol: val.rol || 'OPERADOR',
        activo: val.activo ?? true,
        operador_id: val.operador_id ? Number(val.operador_id) : null,
      };

      if (val.password && val.password.trim().length >= 6) {
        updateData.password = val.password.trim();
      }

      this.usuariosService.update(user.id, updateData).subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeModal();
          this.showNotification('Usuario actualizado exitosamente.');
          this.loadUsers();
        },
        error: (err) => {
          this.submitting.set(false);
          this.modalError.set(err.error?.detail || 'Error al actualizar usuario.');
        },
      });
    } else {
      const createData: UsuarioCrear = {
        nombre: val.nombre?.trim() || '',
        documento: val.documento?.trim() || '',
        correo: val.correo?.trim() || '',
        rol: val.rol || 'OPERADOR',
        password: val.password || '',
        operador_id: val.operador_id ? Number(val.operador_id) : null,
      };

      this.usuariosService.create(createData).subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeModal();
          this.showNotification('Usuario creado exitosamente.');
          this.loadUsers();
        },
        error: (err) => {
          this.submitting.set(false);
          this.modalError.set(err.error?.detail || 'Error al crear usuario.');
        },
      });
    }
  }

  confirmToggleStatus(user: Usuario) {
    this.targetUser.set(user);
    this.showDeactivateModal.set(true);
  }

  closeDeactivateModal() {
    this.showDeactivateModal.set(false);
    this.targetUser.set(null);
  }

  executeToggleStatus() {
    const user = this.targetUser();
    if (!user) return;

    const newStatus = !user.activo;
    this.usuariosService.toggleActivo(user.id, newStatus).subscribe({
      next: () => {
        this.closeDeactivateModal();
        this.showNotification(
          `Usuario ${newStatus ? 'activado' : 'desactivado'} correctamente.`
        );
        this.loadUsers();
      },
      error: (err) => {
        this.closeDeactivateModal();
        this.error.set(
          err.error?.detail || 'Error al modificar el estado del usuario.'
        );
      },
    });
  }

  showNotification(msg: string) {
    this.success.set(msg);
    setTimeout(() => this.success.set(null), 4000);
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
}

import { Routes } from '@angular/router';

const loadHistory = () =>
    import('./pages/reservation-history/reservation-history.component')
        .then(m => m.ReservationHistoryComponent);

export const RESERVATION_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./components/appointment/appointment.component')
                .then(m => m.AppointmentComponent)
    },
    { path: 'history', data: { scope: 'customer' }, loadComponent: loadHistory },
    { path: 'history/employee', data: { scope: 'employee' }, loadComponent: loadHistory },
    { path: 'history/barbershop', data: { scope: 'barbershop' }, loadComponent: loadHistory }
];

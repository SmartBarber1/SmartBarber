import {
    Routes
} from '@angular/router';

import {
    authGuard
} from '../../core/auth/guards/auth.guard';

import {
    roleGuard
} from '../../core/auth/guards/role.guard';





import {
    EmployeeRepository
} from '../employee/domain/repositories/employee.repository';

import {
    EmployeeApiService
} from '../employee/infrastructure/api/employee-api.service';

import {
    CreateEmployeeUseCase
} from '../employee/application/use-cases/create-employee.use-case';
import {
    GetEmployeesByBarbershopUseCase
} from '../employee/application/use-cases/get-employees-by-barbershop.use-case';
import {
    SearchEmployeeUseCase
} from '../employee/application/use-cases/search-employee.use-case';


export const USER_MANAGEMENT_ROUTES:
    Routes = [

        {
            path: '',

            canActivate: [
                authGuard,
                roleGuard
            ],

            data: {
                roles: ['ADMIN']
            },

            providers: [

                {
                    provide:
                        EmployeeRepository,

                    useClass:
                        EmployeeApiService
                },

                CreateEmployeeUseCase,
                GetEmployeesByBarbershopUseCase,
                SearchEmployeeUseCase
            ],

            loadComponent: () =>
                import(
                    './pages/user-management/user-management.component'
                ).then(
                    m =>
                        m.UserManagementComponent
                )
        }
    ];
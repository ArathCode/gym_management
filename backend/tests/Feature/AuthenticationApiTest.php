<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthenticationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_log_in_and_receive_a_bearer_token(): void
    {
        $user = User::factory()->create(['email' => 'staff@example.test']);

        $response = $this->postJson('/api/login', [
            'email' => 'staff@example.test',
            'password' => 'password',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.user.id', $user->id)
            ->assertJsonPath('data.token_type', 'Bearer')
            ->assertJsonStructure(['data' => ['token']]);

        $this->withToken($response->json('data.token'))
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id);
    }

    public function test_invalid_credentials_are_rejected(): void
    {
        User::factory()->create(['email' => 'staff@example.test']);

        $this->postJson('/api/login', [
            'email' => 'staff@example.test',
            'password' => 'incorrect',
        ])->assertUnprocessable();
    }

    public function test_protected_endpoint_requires_authentication(): void
    {
        $this->getJson('/api/members')->assertUnauthorized();
    }

    public function test_logout_revokes_the_current_bearer_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/logout')->assertOk();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/user')->assertUnauthorized();

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }
}
